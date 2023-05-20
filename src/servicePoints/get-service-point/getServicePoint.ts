import { ddbDocClient } from "../../ddb-doc-client";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { IServicePoint } from "../model/service-point.interface";
import { ServicePointItem } from "../model/service-point-item";
import { TableName } from "../../table-name";


export async function getServicePoint(
  servicePoint: Pick<IServicePoint, "id">
): Promise<IServicePoint> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: new ServicePointItem(servicePoint).keys(),
    })
  );
  if (!result.Item) {
    throw new Error("Service point not found 1");
  }

  return ServicePointItem.fromItem(result.Item);
}
