import { QueuePriority, QueueStatus } from "./queue/queue";

export const prefixService = "S#";
const prefixServiceQueue = "SQ#";
export const prefixQueue = "Q#";
export const prefixQueueStatus = "Q_STATUS#";
export const buildQueueKey = (serviceId: string) =>
  `${prefixServiceQueue}${serviceId}`;

export const buildQueueSK = ({
  status,
  priority,
  dateISOString,
}: {
  status: QueueStatus;
  priority: QueuePriority;
  dateISOString: string;
}) =>
  `${prefixQueueStatus}${status}Q_PRIORITY#${priority}#Q_DATE${dateISOString}`;

export const prefixServicePoint = "SP#";
if (!process.env.ONE_TABLE) {
  throw new Error("ONE_TABLE env variable is not set");
}
export const TableName = process.env.ONE_TABLE;
