import { EQueuePriority } from "../enums/queue-priority.enum";
import { EQueueStatus } from "../enums/queue-status.enum";

export interface IQueueItem {
  id: string;
  serviceId: string;
  queueStatus: EQueueStatus;
  priority: EQueuePriority;
  date: string;
  memorableId: string;
}
