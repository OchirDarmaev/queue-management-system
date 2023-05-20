import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { IService } from "../model/service.interface.js";
import { ServiceItem } from "../model/service-item.js";
import { ddbDocClient } from "../../../dynamo-DB-client.js";
import { TableName } from "../../../table-name.js";


export async function getServices(): Promise<IService[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": ServiceItem.prefixService,
        ":sk": ServiceItem.prefixService,
      },
    })
  );

  return result.Items?.map((item) => ServiceItem.fromItem(item)) || [];
}
