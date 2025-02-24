export type Donation = {
  type: 'donation';
  id: number;
  donor: string;
  donor_name: string;
  event: string;
  domain: string;
  transactionstate: string;
  readstate: string;
  commentstate: string;
  bidstate: string;
  amount: string;
  currency: string;
  timereceived: string;
  comment?: string;
  commentlanguage: string;
  pinned: boolean;
  bids: DonationBid[];
};

export type DonationBid = {
  type: 'donationbid';
  id: number;
  donation: string;
  bid: string;
  amount: string;
  bid_name: string;
};

export type Event = {
  type: 'event';
  id: number;
  short: string;
  name: string;
  hashtag: string;
  date: string;
  timezone: string;
  use_one_step_screening: boolean;
};
