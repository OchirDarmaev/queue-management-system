import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { EServicePointStatus } from "../service-point-status.enum";
import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../ddb-doc-client";
import { TableName } from "../../../table-name";

export async function closeServicePoint(servicePoint: ServicePointItem) {
  await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: servicePoint.keys(),
      UpdateExpression: "SET servicePointStatus = :servicePointStatus",
      ExpressionAttributeValues: {
        ":servicePointStatus": EServicePointStatus.CLOSED,
      },
      ConditionExpression:
        "attribute_exists(PK) and attribute_exists(SK) and servicePointStatus <> :servicePointStatus",
    })
  );
}
