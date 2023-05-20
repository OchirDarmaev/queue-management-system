import { IServicePoint } from "../model/service-point.interface";
import { EServicePointStatus } from "../service-point-status.enum";
import { closeServicePoint } from "./close-service-point";
import { markAsServed } from "./mark-as-served";
import { putItemBackToQueue } from "./put-item-back-to-queue";
import { startServicingItemQueue } from "./start-servicing-item-queue";
import { startWaitingQueue } from "./start-waiting-queue";
import { ServicePointItem } from "../model/service-point-item";
import { getServicePoint } from "../get-service-point/get-service-point";

export async function updateServicePointStatus({
  id,
  servicePointStatus: newServicePointStatus,
}: Pick<IServicePoint, "id" | "servicePointStatus">) {
  const servicePoint = new ServicePointItem(await getServicePoint({ id }));
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
          await startWaitingQueue(
            new ServicePointItem(await getServicePoint({ id }))
          );
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
