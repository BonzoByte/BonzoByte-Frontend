// Migration aliases: the lab and main application use the exact same injectable.
export { BillingPaymentsService as BillingLabService } from './billing-payments.service';
export type { BillingPayment as LabPayment, BillingStatus as LabStatus,
    BillingRefundConfirmation as LabRefundConfirmation } from './billing-payments.service';
