import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../ddb-doc-client";
import { ServiceItem } from "../../../services/ServiceItem";
import { IQueueItem } from "../queue-item.interface";
import { QueueItem } from "../model/QueueItem";
import { TableName } from "../../../table-name";

export async function getQueueItems({
  serviceId,
}: {
  serviceId: string;
}): Promise<IQueueItem[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `${QueueItem.prefix}${ServiceItem.prefixService}${serviceId}`,
      },
      ScanIndexForward: true,
    })
  );

  return (
    result.Items?.map((item) => {
      const i = QueueItem.fromItem(item);
      return {
        id: i.id,
        serviceId: i.serviceId,
        queueStatus: i.queueStatus,
        priority: i.priority,
        date: i.date,
        memorableId: i.memorableId,
      };
    }) || []
  );
}
