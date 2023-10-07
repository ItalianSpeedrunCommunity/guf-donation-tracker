import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';

import { useConstants } from '@common/Constants';
import modelActions from '@public/api/actions/models';
import { usePermission } from '@public/api/helpers/auth';
import { useCachedCallback } from '@public/hooks/useCachedCallback';
import { useFetchDonors } from '@public/hooks/useFetchDonors';
import Spinner from '@public/spinner';

import styles from './donations.mod.css';

type Action = 'read' | 'ignored' | 'blocked';

interface State {
  [k: number]: Action;
}

function stateReducer(state: State, { pk, action }: { pk: number; action: Action }) {
  return { ...state, [pk]: action };
}

const stateMap = {
  read: 'Read on the Air',
  ignored: 'Ignored',
  blocked: 'Blocked',
};

export default React.memo(function ReadDonations() {
  const { ADMIN_ROOT } = useConstants();
  const { event: eventId } = useParams<{ event: string }>();
  const status = useSelector((state: any) => state.status);
  const bids = useSelector((state: any) => state.models.bid);
  const donationbids = useSelector((state: any) => state.models.donationbid);
  const donations = useSelector((state: any) => state.models.donation);
  const donors = useSelector((state: any) => state.models.donor);
  const event = useSelector((state: any) => state.models.event?.find((e: any) => e.pk === +eventId!));
  const dispatch = useDispatch();
  const canEditDonors = usePermission('tracker.change_donor');
  const fetchBids = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      const bidparams = {
        event: eventId,
      };

      dispatch(modelActions.loadModels('bid', bidparams));

      e?.preventDefault();
    },
    [dispatch, eventId],
  );
  const fetchDonationBids = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      const donobidparams = {
        event: eventId,
      };

      dispatch(modelActions.loadModels('donationbid', donobidparams));

      e?.preventDefault();
    },
    [dispatch, eventId],
  );
  const fetchDonations = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      const donoparams = {
        all_comments: '',
        event: eventId,
        feed: 'toread',
      };

      dispatch(modelActions.loadModels('donation', donoparams));

      e?.preventDefault();
    },
    [dispatch, eventId],
  );

  const fetchAll = useCallback(
    (e?: React.MouseEvent<HTMLButtonElement>) => {
      fetchBids();
      fetchDonations();
      fetchDonationBids();

      e?.preventDefault();
    },
    [dispatch, eventId],
  )

  useFetchDonors(eventId);
  useEffect(() => {
    fetchBids();
  }, [fetchBids]);
  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);
  useEffect(() => {
    fetchDonationBids();
  }, [fetchDonationBids]);
  const [donationState, dispatchState] = useReducer(stateReducer, {} as State);
  const action = useCachedCallback(
    ({
      pk,
      action,
      readstate,
      commentstate,
      pinned,
    }: {
      pk: number;
      action?: Action;
      readstate?: string;
      commentstate?: string;
      pinned?: number;
    }) => {
      if (action) {
        dispatchState({ pk, action });
      }
      dispatch(
        modelActions.saveDraftModels([
          {
            pk: pk,
            fields: { readstate, commentstate, pinned },
            type: 'donation',
          },
        ]),
      );
    },
    [dispatch],
  );

  const bidAction = useCachedCallback(
    ({ pk, action, state }: { pk: number; action: Action; state: string }) => {
      dispatchState({ pk, action });
      dispatch(
        modelActions.saveDraftModels([
          {
            pk: pk,
            fields: { state },
            type: 'bid',
          },
        ]),
      );
    },
    [dispatch],
  );

  const sortedDonations = useMemo(() => {
    return donations
      ? [...donations].sort((a: any, b: any) => {
          if (a.pinned && !b.pinned) {
            return -1;
          }
          if (b.pinned && !a.pinned) {
            return 1;
          }
          return b.pk - a.pk;
        })
      : [];
  }, [donations]);

  return (
    <div>
      <h3>{event?.name}</h3>
      <button onClick={fetchAll}>Refresh</button>
      <Spinner spinning={status.donation === 'loading'}>
        <table className="table table-condensed table-striped small">
          <tbody>
            {sortedDonations.map((donation: any) => {
              const donor = donors?.find((d: any) => d.pk === donation.donor);
              const donorLabel = donor?.alias ? `${donor.alias}#${donor.alias_num}` : '(Anonymous)';
              const donobids = donationbids?.filter((donobid: any) => donobid.donation === donation.pk);
              const donobidsView = donobids?.map((donobid: any) => {
                const bidObj = bids?.find((bid: any) => bid.pk === donobid.bid);
                return (
                  <tr>
                    <td>{bidObj?.name}</td>
                    <td>&euro;{(+donobid?.amount).toFixed(2)}</td>
                    <td></td>
                    <td>
                      <button
                        onClick={bidAction({
                          pk: bidObj.pk,
                          action: 'accept',
                          state: 'OPENED',
                        })}
                        disabled={bidObj._internal?.saving}>
                        Accept
                      </button>
                      <button
                        onClick={bidAction({
                          pk: bidObj.pk,
                          action: 'deny',
                          state: 'DENIED',
                        })}
                        disabled={bidObj._internal?.saving}>
                        Deny
                      </button>
                    </td>
                    <td></td>
                  </tr>
                )
              });

              return (
                <>
                <tr key={donation.pk}>
                  <td>
                    {canEditDonors ? <a href={`${ADMIN_ROOT}donor/${donation.donor}`}>{donorLabel}</a> : donorLabel}
                  </td>
                  <td>
                    <a href={`${ADMIN_ROOT}donation/${donation.pk}`}>&euro;{(+donation.amount).toFixed(2)}</a>
                  </td>
                  <td className={styles['comment']}>
                    {donation.pinned && '📌'}
                    {donation.comment}
                  </td>
                  <td>
                    <button
                      onClick={action({
                        pk: donation.pk,
                        action: 'read',
                        readstate: 'READ',
                      })}
                      disabled={donation._internal?.saving}>
                      Read
                    </button>
                    <button
                      onClick={action({
                        pk: donation.pk,
                        action: 'ignored',
                        readstate: 'IGNORED',
                      })}
                      disabled={donation._internal?.saving}>
                      Ignore
                    </button>
                    <button
                      onClick={action({
                        pk: donation.pk,
                        action: 'blocked',
                        readstate: 'IGNORED',
                        commentstate: 'DENIED',
                      })}
                      disabled={donation._internal?.saving}>
                      Block Comment
                    </button>
                    <button
                      onClick={
                        donation.pinned
                          ? action({ pk: donation.pk, pinned: 0 })
                          : action({ pk: donation.pk, pinned: 1 })
                      }>
                      {donation.pinned ? 'Unpin Comment' : 'Pin Comment'}
                    </button>
                  </td>
                  <td className={styles['status']}>
                    <Spinner spinning={!!donation._internal?.saving}>
                      {donationState[donation.pk] && stateMap[donationState[donation.pk]]}
                    </Spinner>
                  </td>
                </tr>
                {donobidsView}
                </>
              );
            })}
          </tbody>
        </table>
      </Spinner>
    </div>
  );
});
