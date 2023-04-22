import enum
from contextlib import contextmanager
from typing import Callable

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from tracker import logutil, settings
from tracker.analytics import AnalyticsEventTypes, analytics
from tracker.api.permissions import tracker_permission
from tracker.api.serializers import DonationSerializer
from tracker.consumers.processing import broadcast_processing_action
from tracker.models import Donation

CanChangeDonation = tracker_permission('tracker.change_donation')
CanSendToReader = tracker_permission('tracker.send_to_reader')
CanViewComments = tracker_permission('tracker.view_comments')


class DonationProcessingActionTypes(str, enum.Enum):
    UNPROCESSED = 'unprocessed'
    APPROVED = 'approved'
    DENIED = 'denied'
    FLAGGED = 'flagged'
    SENT_TO_READER = 'sent_to_reader'
    PINNED = 'pinned'
    UNPINNED = 'unpinned'
    READ = 'read'
    IGNORED = 'ignored'
    MOD_COMMENT_EDITED = 'mod_comment_edited'


DONATION_CHANGE_LOG_MESSAGES = {
    DonationProcessingActionTypes.UNPROCESSED: 'reset donation comment processing status',
    DonationProcessingActionTypes.APPROVED: 'approved donation comment',
    DonationProcessingActionTypes.DENIED: 'denied donation comment',
    DonationProcessingActionTypes.FLAGGED: 'flagged donation to head',
    DonationProcessingActionTypes.SENT_TO_READER: 'sent donation to reader',
    DonationProcessingActionTypes.PINNED: 'pinned donation for reading',
    DonationProcessingActionTypes.UNPINNED: 'unpinned donation for reading',
    DonationProcessingActionTypes.READ: 'read donation',
    DonationProcessingActionTypes.IGNORED: 'ignored donation',
    DonationProcessingActionTypes.MOD_COMMENT_EDITED: 'edited the mod comment',
}

DONATION_ACTION_ANALYTICS_EVENTS = {
    DonationProcessingActionTypes.UNPROCESSED: AnalyticsEventTypes.DONATION_COMMENT_UNPROCESSED,
    DonationProcessingActionTypes.APPROVED: AnalyticsEventTypes.DONATION_COMMENT_APPROVED,
    DonationProcessingActionTypes.DENIED: AnalyticsEventTypes.DONATION_COMMENT_DENIED,
    DonationProcessingActionTypes.FLAGGED: AnalyticsEventTypes.DONATION_COMMENT_FLAGGED,
    DonationProcessingActionTypes.SENT_TO_READER: AnalyticsEventTypes.DONATION_COMMENT_SENT_TO_READER,
    DonationProcessingActionTypes.PINNED: AnalyticsEventTypes.DONATION_COMMENT_PINNED,
    DonationProcessingActionTypes.UNPINNED: AnalyticsEventTypes.DONATION_COMMENT_UNPINNED,
    DonationProcessingActionTypes.READ: AnalyticsEventTypes.DONATION_COMMENT_READ,
    DonationProcessingActionTypes.IGNORED: AnalyticsEventTypes.DONATION_COMMENT_IGNORED,
    DonationProcessingActionTypes.MOD_COMMENT_EDITED: AnalyticsEventTypes.DONATION_MOD_COMMENT_EDITED,
}


def _get_donation_analytics_fields(donation: Donation):
    return {
        'event_id': donation.event.id,
        'donation_id': donation.id,
        'amount': donation.amount,
        'is_anonymous': donation.anonymous(),
        'num_bids': donation.bids.count(),
        'currency': donation.currency,
        'comment': donation.comment,
        'comment_language': donation.commentlanguage,
        'domain': donation.domain,
        # TODO: Update to track these fields properly
        'is_first_donation': False,
        'from_partner': False,
    }


def _track_donation_processing_event(
    action: DonationProcessingActionTypes,
    donation: Donation,
    request,
):
    # Add to local event audit log
    logutil.change(request, donation, DONATION_CHANGE_LOG_MESSAGES[action])

    # Track event to analytics database
    analytics.track(
        DONATION_ACTION_ANALYTICS_EVENTS[action],
        {
            **_get_donation_analytics_fields(donation),
            'user_id': request.user.pk,
        },
    )

    # Announce the action to all other processors
    broadcast_processing_action(request.user, donation, action)


class DonationChangeManager:
    def __init__(self, request, pk: str, get_serializer: Callable):
        self.request = request
        self.pk = pk
        self.get_serializer = get_serializer

    @contextmanager
    def change_donation(self, action: DonationProcessingActionTypes):
        self.donation = get_object_or_404(Donation, pk=self.pk)
        yield self.donation
        self.donation.save()
        _track_donation_processing_event(
            action=action, request=self.request, donation=self.donation
        )

    def response(self):
        return Response(self.get_serializer(self.donation).data)


class DonationViewSet(viewsets.GenericViewSet):
    serializer_class = DonationSerializer

    def get_queryset(self):
        """
        Processing only occurs on Donations that have settled their transaction
        and were not tests.
        """
        event_id = self.request.query_params.get('event_id')
        query = Donation.objects.filter(
            event_id=event_id, transactionstate='COMPLETED', testdonation=False
        ).order_by('timereceived')

        after = self.request.query_params.get('after')
        if after is not None:
            query = query.filter(Q(timereceived__gte=after))

        return query

    def get_serializer(self, *args, **kwargs):
        return super().get_serializer(
            *args, with_permissions=self.request.user.get_all_permissions(), **kwargs
        )

    def list(self, _request):
        """
        Return a list of donations matching the given IDs, provided as a series
        of `ids[]` query parameters, up to a maximum of TRACKER_PAGINATION_LIMIT.
        If no IDs are provided, an empty list is returned.
        """
        donation_ids = self.request.query_params.getlist('ids[]')
        limit = settings.TRACKER_PAGINATION_LIMIT
        if len(donation_ids) == 0:
            return Response([])
        if len(donation_ids) > limit:
            return Response(
                {
                    'error': f'Only a maximum of {limit} donations may be specified at a time'
                },
                status=422,
            )
        donations = Donation.objects.filter(pk__in=donation_ids)
        serializer = self.get_serializer(donations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[CanViewComments])
    def unprocessed(self, _request):
        """
        Return a list of the oldest completed donations for the event which have
        not yet been processed in any way (e.g., are still PENDING for comment
        moderation), up to a maximum of TRACKER_PAGINATION_LIMIT donations.
        """
        limit = settings.TRACKER_PAGINATION_LIMIT
        donations = (
            self.get_queryset()
            .filter(Q(commentstate='PENDING') | Q(readstate='PENDING'))
            .prefetch_related('bids')
        )[0:limit]
        serializer = self.get_serializer(donations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[CanViewComments])
    def flagged(self, _request):
        """
        Return a list of the oldest completed donations for the event which have
        been flagged for head review (e.g., are FLAGGED for read moderation),
        up to a maximum of TRACKER_PAGINATION_LIMIT donations.
        """
        limit = settings.TRACKER_PAGINATION_LIMIT
        donations = (
            self.get_queryset()
            .filter(Q(commentstate='APPROVED') & Q(readstate='FLAGGED'))
            .prefetch_related('bids')
        )[0:limit]
        serializer = self.get_serializer(donations, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[CanViewComments])
    def unread(self, _request):
        """
        Return a list of the oldest completed donations for the event which have
        been approved and sent to the reader (e.g., have a READY readstate),
        up to a maximum of TRACKER_PAGINATION_LIMIT donations.
        """
        limit = settings.TRACKER_PAGINATION_LIMIT
        donations = (
            self.get_queryset()
            .filter(Q(commentstate='APPROVED') & Q(readstate='READY'))
            .prefetch_related('bids')
        )[0:limit]
        serializer = self.get_serializer(donations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def unprocess(self, request, pk):
        """
        Reset the comment and read states for the donation.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.UNPROCESSED
        ) as donation:
            donation.commentstate = 'PENDING'
            donation.readstate = 'PENDING'

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def approve_comment(self, request, pk):
        """
        Mark the comment for the donation as approved, but do not send it on to
        be read.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.APPROVED
        ) as donation:
            donation.commentstate = 'APPROVED'
            donation.readstate = 'IGNORED'

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def deny_comment(self, request, pk):
        """
        Mark the comment for the donation as explicitly denied and ignored.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.DENIED
        ) as donation:
            donation.commentstate = 'DENIED'
            donation.readstate = 'IGNORED'

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def flag(self, request, pk):
        """
        Mark the donation as approved, but flagged for head donations to review
        before sending to the reader. This should only be called when the event
        is using two step screening.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.FLAGGED
        ) as donation:
            donation.commentstate = 'APPROVED'
            donation.readstate = 'FLAGGED'

        return manager.response()

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[CanChangeDonation & CanSendToReader],
    )
    def send_to_reader(self, request, pk):
        """
        Mark the donation as approved and send it directly to the reader.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.SENT_TO_READER
        ) as donation:
            donation.commentstate = 'APPROVED'
            donation.readstate = 'READY'

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def pin(self, request, pk):
        """
        Mark the donation as pinned to the top of the reader's view.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.PINNED
        ) as donation:
            donation.pinned = True

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def unpin(self, request, pk):
        """
        Umark the donation as pinned, returning it to a normal position in the donation list.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.UNPINNED
        ) as donation:
            donation.pinned = False

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def read(self, request, pk):
        """
        Mark the donation as read, completing the donation's lifecycle.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.READ
        ) as donation:
            donation.readstate = 'READ'

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def ignore(self, request, pk):
        """
        Mark the donation as ignored, completing the donation's lifecycle.
        """
        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.IGNORED
        ) as donation:
            donation.readstate = 'IGNORED'

        return manager.response()

    @action(detail=True, methods=['post'], permission_classes=[CanChangeDonation])
    def comment(self, request, pk):
        """
        Add or edit the `modcomment` for the donation. Currently donations only
        store a single comment; providing a new comment will override whatever
        comment currently exists.
        """
        comment = request.data.get('comment', None)
        if comment is None:
            return Response({'error': '`comment` must be provided'}, status=422)

        manager = DonationChangeManager(request, pk, self.get_serializer)
        with manager.change_donation(
            action=DonationProcessingActionTypes.MOD_COMMENT_EDITED
        ) as donation:
            donation.modcomment = comment

        return manager.response()
