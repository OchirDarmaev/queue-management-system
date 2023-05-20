import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { IServicePoint } from "../model/service-point.interface";
import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { TableName } from "../../../table-name";
import { ulid } from "ulid";
import { EServicePointStatus } from "../service-point-status.enum";

export async function createServicePoint(servicePoint: {
  name: string;
  description: string;
  serviceIds?: string[];
}): Promise<IServicePoint> {
  const id = ulid();
  const servicePointItem = new ServicePointItem({
    id,
    ...servicePoint,
    servicePointStatus: EServicePointStatus.DEFAULT,
  });
  // todo create service point number
  // todo validate service ids

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
