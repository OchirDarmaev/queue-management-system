import { IoTClient, CreatePolicyCommand } from "@aws-sdk/client-iot";

const iotClient = new IoTClient({ region: "us-east-1" });

async function createPolicy() {
  const policyName = "MyIotPolicy";
  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "iot:Connect",
        Resource: "*",
      },
      // Add more statements here based on your requirements
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

createPolicy();

import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot"; // Importing AWS IoT Client and commands

const iotClient = new IoTClient({ region: "us-east-1" }); // Initializing the IoT Client with your region

async function attachPrincipalPolicy() {
  const params = {
    policyName: "MyIotPolicy",
    target:
      "arn:aws:iot:us-east-1:123456789012:cert/51293a8e-067d-4c68-b62c-07c3180c89d5", // Your principal's ARN
  };

  try {
    const data = await iotClient.send(new AttachPolicyCommand(params));
    console.log("Policy attached successfully:", data);
  } catch (err) {
    console.error("Error attaching policy:", err);
  }
}

attachPrincipalPolicy();
