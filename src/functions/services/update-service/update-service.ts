import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { IService } from "../model/service.interface.js";
import { ServiceItem } from "../model/service-item.js";
import { ddbDocClient } from "../../../dynamo-DB-client.js";
import { TableName } from "../../../table-name.js";

type UpdateServiceDto = Pick<IService, "id"> & Partial<IService>;
export async function updateService(dto: UpdateServiceDto): Promise<IService> {
  const keys = ServiceItem.buildKey(dto.id);

  const result = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: keys,
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
    throw new Error("not found");
  }

  return ServiceItem.fromItem(result.Attributes);
}
