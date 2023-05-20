import { ddbDocClient } from "../../ddb-doc-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ServicePointItem } from "../model/service-point-item";
import { TableName } from "../../table-name";


export async function getServicePoints() {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk and begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": ServicePointItem.prefixServicePoint,
        ":sk": ServicePointItem.prefixServicePoint,
      },
    })
  );

  return result?.Items?.map((item) => ServicePointItem.fromItem(item)) || [];
}
