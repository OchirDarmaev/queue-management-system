import {
  IoTClient,
  CreatePolicyCommand,
  paginateListDetectMitigationActionsExecutions,
} from "@aws-sdk/client-iot";
import { AttachPolicyCommand } from "@aws-sdk/client-iot"; // Importing AWS IoT Client and commands
import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

const region = process.env.REGION; // Replace with your region
const accountId = process.env.ACCOUNT_ID; // Replace with your account ID

const iotClient = new IoTClient({ region });
const prefix = process.env.SERVICE_PREFIX;
const serviceName = process.env.SERVICE_NAME;
const stage = process.env.STAGE;
const policyName = `${serviceName}-${stage}-MyNewIotPolicy`;
console.log("policyName", policyName);

async function createPolicy() {
  const topicName =
    "queue-management-system/dev/service-points/01H0K0EDB8EGAJZ55BVZPT72H1";

  const topicArn = `arn:aws:iot:${region}:${accountId}:${topicName}`; // replace with your actual topic ARN
  console.log("topicArn", topicArn);
  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "iot:Connect",
        Resource: topicArn,
      },
      {
        Effect: "Allow",
        Action: "iot:Receive",
        Resource: topicArn,
      },
      {
        Effect: "Allow",
        Action: "iot:Subscribe",
        Resource: topicArn,
      },
    ],
  };

  const params = {
    policyName: policyName,
    policyDocument: JSON.stringify(policyDocument), // policyDocument must be a JSON string
  };

  try {
    const data = await iotClient.send(new CreatePolicyCommand(params));
    console.log("Policy created successfully:", data);
  } catch (err) {
    console.error("Error creating policy:", err);
  }
}

async function attachPrincipalPolicy() {
  const principal = "us-east-1:51293a8e-067d-4c68-b62c-07c3180c89d5";
  const params = {
    policyName,
    target: principal,
  };

  try {
    const data = await iotClient.send(new AttachPolicyCommand(params));
    console.log("Policy attached successfully:", data);
  } catch (err) {
    console.error("Error attaching policy:", err);
  }
}

export const handler = middy(async () => {
  // await createPolicy();
  await attachPrincipalPolicy();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello World!" }),
    headers: {
      "content-type": "application/json",
    },
  };
})
  .use(errorLogger())
  .onError(onErrorHandler);
