import { ddbDocClient } from "../../ddb-doc-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ServicePointItem } from "../model/service-point-item";
import { TableName } from "../../table-name";


export async function getServicePoint2(id: string) {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: new ServicePointItem({ id }).keys(),
    })
  );
  if (!result.Item) {
    throw new Error("Service point not found 3");
  }
  return ServicePointItem.fromItem(result.Item);
}
