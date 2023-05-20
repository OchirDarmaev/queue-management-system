import { BatchGetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { IServicePoint } from "../model/service-point.interface";
import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { TableName } from "../../../table-name";
import { ServiceItem } from "../../services/model/service-item";

type UpdateServicePointDto = Pick<IServicePoint, "id"> &
  Partial<
    Pick<
      IServicePoint,
      "name" | "description" | "serviceIds" | "servicePointNumber"
    >
  >;

export async function updateServicePoint(
  dto: UpdateServicePointDto
): Promise<IServicePoint> {
  if (dto.serviceIds?.length) {
    const result1 = await ddbDocClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TableName]: {
            Keys: dto.serviceIds.map((id) => ({
              PK: ServiceItem.prefixService,
              SK: ServiceItem.prefixService + id,
            })),
          },
        },
      })
    );

    if (result1?.Responses?.[TableName]?.length !== dto.serviceIds.length) {
      throw new Error("Service not found");
    }
  }

  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: new ServicePointItem(dto).keys(),
      UpdateExpression:
        "SET " +
        Object.entries(dto)
          .filter(([key, value]) => value !== undefined)
          .map(([key, value]) => `#${key} = :${key}`)
          .join(", "),
      ExpressionAttributeNames: Object.entries(dto)
        .filter(([key, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[`#${key}`] = key;
          return acc;
        }, {}),
      ExpressionAttributeValues: Object.entries(dto)

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

  return ServicePointItem.fromItem(result.Attributes);
}
