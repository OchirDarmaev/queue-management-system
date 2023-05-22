import {
  IoTClient,
  CreatePolicyCommand,
  AttachPolicyCommand,
  DetachPolicyCommand,
} from "@aws-sdk/client-iot"; // Importing AWS IoT Client and commands
import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

const region = process.env.REGION; // Replace with your region
const accountId = process.env.ACCOUNT_ID; // Replace with your account ID

const iotClient = new IoTClient({ region });
const prefix = process.env.SERVICE_PREFIX;
const serviceName = process.env.SERVICE_NAME;
const stage = process.env.STAGE;

async function createPolicy({
  uri,
  policyName,
}: {
  uri: string;
  policyName: string;
}) {
  const prefix = process.env.SERVICE_PREFIX;
  const topicName = `${prefix}/${uri}`;
  const topicArn = `arn:aws:iot:${region}:${accountId}:${topicName}`; // replace with your actual topic ARN

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

  const data = await iotClient.send(
    new CreatePolicyCommand({
      policyName,
      policyDocument: JSON.stringify(policyDocument),
    })
  );

  console.log("Policy created successfully:", data);
}

async function attachPrincipalPolicy({
  principal,
  policyName,
}: {
  principal: string;
  policyName: string;
}) {
  const data = await iotClient.send(
    new AttachPolicyCommand({
      policyName,
      target: principal,
      
    })
  );
  console.log("Policy attached successfully:", data);
}

export const handler = middy(async () => {
  const uri = "service-points/01H0K0EDB8EGAJZ55BVZPT72H1";

  const principal = "us-east-1:51293a8e-067d-4c68-b62c-07c3180c89d5";

  // policyName must satisfy regular expression pattern: [\w+=,.@-]+
  const policyName = `${serviceName}-${stage}-${uri}`.replace(/\//g, "-");

  await createPolicy({ uri, policyName });
  await attachPrincipalPolicy({
    principal,
    policyName,
  });

  // TODO
  // check if policy exists
  // update policy
  // detach policy from principal
  // attach policy to principal
})
  .use(errorLogger())
  .onError(onErrorHandler);

  // The active and previous versions of this policy. Only one version can be active. A policy can have no more than 5 versions. To update a policy with 5 versions, you must first delete one.
// UPDATE POLICY EXAMPLE
// const newPolicyDocument = {
//   //... your updated policy document ...
// };
// const policyVersionParams = {
//   policyName: 'yourPolicyName',
//   policyDocument: JSON.stringify(newPolicyDocument),
//   setAsDefault: true // Optional
// };
// const createPolicyVersionCommand = new CreatePolicyVersionCommand(policyVersionParams);
// const response = await client.send(createPolicyVersionCommand);
