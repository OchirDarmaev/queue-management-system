import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EServicePointStatus } from "../service-point-status.enum";
import { ServicePointItem } from "../model/service-point-item";
import { updateServicePointStatus } from "../update-status-service-point/update-status-service-point";
import { TableName } from "../../../table-name";
import { ddbDocClient } from "../../../ddb-doc-client";

export async function notifyNewItem(serviceId: string) {
  // get all service point that has this service and servicePointStatus = "waiting" and don't have any item in queue
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      FilterExpression:
        "servicePointStatus = :servicePointStatus and contains(serviceIds, :serviceId) and currentQueueItem = :empty",
      ExpressionAttributeValues: {
        ":pk": ServicePointItem.prefixServicePoint,
        ":sk": ServicePointItem.prefixServicePoint,
        ":servicePointStatus": EServicePointStatus.WAITING,
        ":serviceId": serviceId,
        ":empty": "",
      },
      ProjectionExpression: "SK, servicePointStatus",
    })
  );

  if (!result?.Items?.length) {
    return;
  }

  const servicePointIds = result.Items.map(
    (item) => ServicePointItem.fromItem(item).id
  );

  // todo consider workload balancing between service points
  // now most of the time, the first service point will be selected
  for (const servicePointId of servicePointIds) {
    await updateServicePointStatus({
      id: servicePointId,
      servicePointStatus: EServicePointStatus.WAITING,
    });
  }
}
