import { BatchGetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { IServicePoint } from "../model/service-point.interface";
import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../ddb-doc-client";
import { ServiceItem } from "../../../services/ServiceItem";
import { TableName } from "../../../table-name";

export async function updateServicePoint(
  servicePoint: Omit<IServicePoint, "servicePointStatus">
): Promise<IServicePoint> {
  if (servicePoint.serviceIds?.length) {
    const result1 = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TableName]: {
            Keys: servicePoint.serviceIds.map((id) => ({
              PK: ServiceItem.prefixService,
              SK: ServiceItem.prefixService + id,
            })),
          },
        },
      })
    );

    if (
      result1?.Responses?.[TableName]?.length !== servicePoint.serviceIds.length
    ) {
      throw new Error("Service not found");
    }
  }

  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: new ServicePointItem(servicePoint).keys(),
      UpdateExpression:
        "SET " +
        Object.entries(servicePoint)
          .filter(([key, value]) => value !== undefined)
          .map(([key, value]) => `#${key} = :${key}`)
          .join(", "),
      ExpressionAttributeNames: Object.entries(servicePoint)
        .filter(([key, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[`#${key}`] = key;
          return acc;
        }, {}),
      ExpressionAttributeValues: Object.entries(servicePoint)

        .filter(([key, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[`:${key}`] = value;
          return acc;
        }, {}),
      ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
      ReturnValues: "ALL_NEW",
    })
  );
  if (!result.Attributes) {
    throw new Error("Service point not found 2");
  }

  return new ServicePointItem(result.Attributes);
}
