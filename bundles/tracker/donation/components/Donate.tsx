import React from 'react';
import { useSelector } from 'react-redux';

import { useConstants } from '@common/Constants';
import { useCachedCallback } from '@public/hooks/useCachedCallback';
import * as CurrencyUtils from '@public/util/currency';
import Anchor from '@uikit/Anchor';
import Button from '@uikit/Button';
import Container from '@uikit/Container';
import CurrencyInput from '@uikit/CurrencyInput';
import ErrorAlert from '@uikit/ErrorAlert';
import Header from '@uikit/Header';
import RadioGroup from '@uikit/RadioGroup';
import Text from '@uikit/Text';
import TextInput from '@uikit/TextInput';

import * as EventDetailsStore from '@tracker/event_details/EventDetailsStore';
import useDispatch from '@tracker/hooks/useDispatch';
import { StoreState } from '@tracker/Store';

import { AnalyticsEvent, track } from '../../analytics/Analytics';
import * as DonationActions from '../DonationActions';
import { AMOUNT_PRESETS, EMAIL_OPTIONS } from '../DonationConstants';
import * as DonationStore from '../DonationStore';
import DonationIncentives from './DonationIncentives';
import DonationPrizes from './DonationPrizes';

import styles from './Donate.mod.css';

type DonateProps = {
  eventId: string | number;
};

const Donate = (props: DonateProps) => {
  const { PRIVACY_POLICY_URL } = useConstants();
  const dispatch = useDispatch();
  const { eventId } = props;

  const { eventDetails, prizes, donation, bids, commentErrors, donationValidity } = useSelector(
    (state: StoreState) => ({
      eventDetails: EventDetailsStore.getEventDetails(state),
      prizes: EventDetailsStore.getPrizes(state),
      donation: DonationStore.getDonation(state),
      bids: DonationStore.getBids(state),
      commentErrors: DonationStore.getCommentFormErrors(state),
      donationValidity: DonationStore.validateDonation(state),
    }),
  );

  React.useEffect(() => {
    track(AnalyticsEvent.DONATE_FORM_VIEWED, {
      event_url_id: eventId,
      prize_count: prizes.length,
      bid_count: bids.length,
    });
    // Only want to fire this event when the context of the page changes, not when data updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const { receiverName, donateUrl, minimumDonation, maximumDonation, step } = eventDetails;
  const { name, email, wantsEmails, amount, comment } = donation;

  const updateDonation = React.useCallback(
    (fields = {}) => {
      dispatch(DonationActions.updateDonation(fields));
    },
    [dispatch],
  );

  const handleSubmit = React.useCallback(() => {
    if (donationValidity.valid) {
      DonationActions.submitDonation(donateUrl, eventDetails.csrfToken, donation, bids);
    }
  }, [donateUrl, eventDetails.csrfToken, donation, bids, donationValidity]);

  const updateName = React.useCallback(name => updateDonation({ name }), [updateDonation]);
  const updateEmail = React.useCallback(email => updateDonation({ email }), [updateDonation]);
  const updateWantsEmails = React.useCallback(value => updateDonation({ wantsEmails: value }), [updateDonation]);
  const updateAmount = React.useCallback(amount => updateDonation({ amount }), [updateDonation]);
  const updateAmountPreset = useCachedCallback(amountPreset => updateDonation({ amount: amountPreset }), [
    updateDonation,
  ]);
  const updateComment = React.useCallback(comment => updateDonation({ comment }), [updateDonation]);

  return (
    <Container>
      <img src="https://donations-static.italianspeedruncommunity.com/static/images/guf23.png" class="header-logo" />
      <ErrorAlert errors={commentErrors.__all__} />
      <Header size={Header.Sizes.H1} marginless>
        Grazie per la donazione!
      </Header>
      <Text size={Text.Sizes.SIZE_16}>Il 100% delle donazioni vanno direttamente a {receiverName}.</Text>

      <section className={styles.section}>
        <ErrorAlert errors={commentErrors.requestedalias} />
        <TextInput
          name="alias"
          value={name}
          label="Nome da visualizzare/Nickname"
          hint="Lasciare in bianco per donare anonimamente"
          size={TextInput.Sizes.LARGE}
          onChange={updateName}
          maxLength={32}
          autoFocus
        />
        <ErrorAlert errors={commentErrors.requestedemail} />

        <ErrorAlert errors={commentErrors.requestedsolicitemail} />

        <ErrorAlert errors={commentErrors.amount} />

        <CurrencyInput
          name="amount"
          value={amount}
          label="Donazione"
          hint={
            <React.Fragment>
              La donazione minima è di <strong>{CurrencyUtils.asCurrency(minimumDonation)}</strong>
            </React.Fragment>
          }
          size={CurrencyInput.Sizes.LARGE}
          onChange={updateAmount}
          step={step}
          min={minimumDonation}
          max={maximumDonation}
        />
        <div className={styles.amountPresets}>
          {AMOUNT_PRESETS.map(amountPreset => (
            <Button
              className={styles.amountPreset}
              key={amountPreset}
              look={Button.Looks.OUTLINED}
              onClick={updateAmountPreset(amountPreset)}>
              €{amountPreset}
            </Button>
          ))}
        </div>

        <ErrorAlert errors={commentErrors.comment} />

        <TextInput
          name="comment"
          value={comment}
          label="Vuoi lasciare un commento?"
          placeholder="Inserisci il commento qui"
          hint="Evitare linguaggio offensivo o scurrile. Tutti i commenti delle donazioni vengono controllati e saranno rimossi dal sito se ritenuti inaccettabili."
          multiline
          onChange={updateComment}
          maxLength={5000}
          rows={5}
        />
      </section>

      {prizes.length > 0 && (
        <section className={styles.section}>
          <DonationPrizes eventId={eventId} />
        </section>
      )}

      <section className={styles.section}>
        <Header size={Header.Sizes.H3}>Incentivi</Header>
        <Text>
          Gli incentivi possono essere usati per aggiungere run bonus alla schedule o per influenzare le scelte dei runner. Vuoi destinare la tua donazione a un incentivo? 
        </Text>
        <DonationIncentives className={styles.incentives} step={step} total={amount != null ? amount : 0} />
      </section>

      <section className={styles.section}>
        <Header size={Header.Sizes.H3}>Dona!</Header>
        {!donationValidity.valid && <Text>{donationValidity.errors.map(error => error.message)}</Text>}
        <Button
          size={Button.Sizes.LARGE}
          disabled={!donationValidity.valid}
          fullwidth
          onClick={handleSubmit}
          data-testid="donation-submit">
          Dona {amount != null ? CurrencyUtils.asCurrency(amount) : null}
        </Button>
      </section>
    </Container>
  );
};

export default Donate;
