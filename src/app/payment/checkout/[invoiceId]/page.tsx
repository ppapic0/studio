import { CheckoutPageClient } from '@/components/payment/checkout-page-client';

const DEFAULT_TOSS_TEST_CLIENT_KEY = 'test_ck_AQ92ymxN34NDobpk74e0rajRKXvd';
const TOSS_CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ||
  (process.env.NODE_ENV !== 'production' ? DEFAULT_TOSS_TEST_CLIENT_KEY : '');

export default async function CheckoutPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <CheckoutPageClient invoiceId={invoiceId} tossClientKey={TOSS_CLIENT_KEY} />;
}
