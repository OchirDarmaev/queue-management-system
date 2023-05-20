import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { IServicePoint } from "../model/service-point.interface";
import { ServicePointItem } from "../model/service-point-item";
import { TableName } from "../../../table-name";
import { ddbDocClient } from "../../../ddb-doc-client";

export async function deleteServicePoint(
  servicePoint: Pick<IServicePoint, "id">
) {
  const result = await ddbDocClient.send(
    new DeleteCommand({
      TableName,
      Key: new ServicePointItem(servicePoint).keys(),
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
    })
  );
  return result;
}
