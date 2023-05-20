import { ddbDocClient } from "../../dynamo-DB-client";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { TableName } from "../../table-name";
import { ServicePointItem } from "../../functions/service-points/model/service-point-item";
import { IServicePoint } from "../../functions/service-points/model/service-point.interface";

export async function createServicePoint(
  servicePoint: IServicePoint
): Promise<IServicePoint> {
  const servicePointItem = new ServicePointItem(servicePoint);

  await ddbDocClient.send(
    new PutCommand({
      TableName,
      Item: servicePointItem.toItem(),
      ConditionExpression:
        "attribute_not_exists(PK) AND attribute_not_exists(SK)",
    })
  );

  return {
    id: servicePointItem.id,
    serviceIds: servicePointItem.serviceIds,
    name: servicePointItem.name,
    description: servicePointItem.description,
    servicePointStatus: servicePointItem.servicePointStatus,
    servicePointNumber: servicePointItem.servicePointNumber,
  };
}
