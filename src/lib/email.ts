import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({
  region: process.env.AWS_SES_REGION || "eu-west-1",
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function sendVerificationEmail(
  email: string,
  token: string,
  baseUrl: string
) {
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;
  const fromDomain = process.env.MAIL_DOMAIN || "serika.pro";

  const command = new SendEmailCommand({
    FromEmailAddress: `SerikaCloud <noreply@${fromDomain}>`,
    Destination: {
      ToAddresses: [email],
    },
    Content: {
      Simple: {
        Subject: { Data: "Verify your SerikaCloud account", Charset: "UTF-8" },
        Body: {
          Html: {
            Data: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 40px; text-align: center; color: white;">
                  <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700;">☁️ SerikaCloud</h1>
                  <p style="margin: 0; opacity: 0.9; font-size: 14px;">Your files, your cloud</p>
                </div>
                <div style="background: #ffffff; border-radius: 16px; padding: 40px; margin-top: -20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                  <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 22px;">Verify your email</h2>
                  <p style="color: #555; line-height: 1.6; margin: 0 0 24px;">
                    Thanks for signing up! Click the button below to verify your email address and start using SerikaCloud.
                  </p>
                  <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                    Verify Email
                  </a>
                  <p style="color: #999; font-size: 12px; margin: 24px 0 0; line-height: 1.5;">
                    If you didn't create an account, you can safely ignore this email.<br/>
                    This link expires in 24 hours.
                  </p>
                </div>
              </div>
            `,
            Charset: "UTF-8",
          },
          Text: {
            Data: `Welcome to SerikaCloud!\n\nPlease verify your email by clicking this link:\n${verifyUrl}\n\nIf you didn't create an account, you can safely ignore this email.`,
            Charset: "UTF-8",
          },
        },
      },
    },
  });

  await ses.send(command);
}
