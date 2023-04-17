import { QueuePriority } from "./QueuePriority";
import { QueueStatus } from "./QueueStatus";


export interface IQueueItem {
  id: string;
  serviceId: string;
  queueStatus: QueueStatus;
  priority: QueuePriority;
  date: string;
  memorableId: string;
}
