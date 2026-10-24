import { getApp } from "./hono";
import getDomains from "./api/domains/get-domains";
import sendEmail from "./api/emails/send-email";
import getEmail from "./api/emails/get-email";
import listEmails from "./api/emails/list-emails";
import updateEmailScheduledAt from "./api/emails/update-email";
import cancelScheduledEmail from "./api/emails/cancel-email";
import createDomain from "./api/domains/create-domain";
import verifyDomain from "./api/domains/verify-domain";
import getDomain from "./api/domains/get-domain";
import deleteDomain from "./api/domains/delete-domain";
import sendBatch from "./api/emails/batch-email";
import emailTimeSeries from "./api/analytics/email-time-series";
import reputationMetricsData from "./api/analytics/reputation-metrics-data";

export const app = getApp();

/**Domain related APIs */
getDomains(app);
createDomain(app);
verifyDomain(app);
getDomain(app);
deleteDomain(app);

/**Email related APIs */
getEmail(app);
listEmails(app);
sendEmail(app);
sendBatch(app);
updateEmailScheduledAt(app);
cancelScheduledEmail(app);

/**Analytics related APIs */
emailTimeSeries(app);
reputationMetricsData(app);

export default app;
