import { EServicePointStatus } from "../service-point-status.enum";
import { IServicePoint } from "../model/service-point.interface";
import { getServicePoint2 } from "./getServicePoint2";
import { startWaitingQueue } from "./startWaitingQueue";
import { closeServicePoint } from "./closeServicePoint";
import { startServicingItemQueue } from "./startServicingItemQueue";
import { putItemBackToQueue } from "./putItemBackToQueue";
import { markAsServed } from "./markAsServed";

export async function updateServicePointStatus({
  id,
  servicePointStatus: newServicePointStatus,
}: Pick<IServicePoint, "id" | "servicePointStatus">) {
  const servicePoint = await getServicePoint2(id);
  console.log("status", servicePoint.servicePointStatus, newServicePointStatus);
  switch (servicePoint.servicePointStatus) {
    case EServicePointStatus.CLOSED:
      switch (newServicePointStatus) {
        case EServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
          return;
        case EServicePointStatus.CLOSED:
          return;
        default:
          throw new Error("Invalid status");
      }
    case EServicePointStatus.WAITING:
      if (!servicePoint.serviceIds || servicePoint.serviceIds.length === 0) {
        throw new Error("Service point has no service");
      }

      switch (newServicePointStatus) {
        case EServicePointStatus.CLOSED:
          await putItemBackToQueue(servicePoint);
          await closeServicePoint(servicePoint);
          return;
        case EServicePointStatus.IN_SERVICE:
          await startServicingItemQueue(servicePoint);
          return;
        case EServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
          return;
        default:
          throw new Error("Invalid status");
      }
    case EServicePointStatus.IN_SERVICE:
      switch (newServicePointStatus) {
        case EServicePointStatus.CLOSED:
          await markAsServed(servicePoint);
          await closeServicePoint(servicePoint);
          return;

        case EServicePointStatus.WAITING:
          await markAsServed(servicePoint);
          const servicePoint2 = await getServicePoint2(id);
          await startWaitingQueue(servicePoint2);
          return;
        case EServicePointStatus.IN_SERVICE:
          return;
        default:
          throw new Error("Invalid status");
      }
    case EServicePointStatus.SERVED:
      switch (newServicePointStatus) {
        case EServicePointStatus.CLOSED:
          await closeServicePoint(servicePoint);
          return;
        case EServicePointStatus.WAITING:
          await startWaitingQueue(servicePoint);
          return;
        case EServicePointStatus.SERVED:
          return;

        default:
          throw new Error("Invalid status");
      }
  }
}
