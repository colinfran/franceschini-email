import { db } from "../db";
import { UnsendApiError } from "./api-error";

export const checkIsValidEmailId = async (emailId: string, teamId: number) => {
  const email = await db.email.findUnique({ where: { id: emailId, teamId } });

  if (!email) {
    throw new UnsendApiError({ code: "NOT_FOUND", message: "Email not found" });
  }
};

export const checkIsValidEmailIdWithDomainRestriction = async (
  emailId: string,
  teamId: number,
  apiKeyDomainId?: number,
) => {
  const whereClause: { id: string; teamId: number; domainId?: number } = {
    id: emailId,
    teamId,
  };

  if (apiKeyDomainId !== undefined) {
    whereClause.domainId = apiKeyDomainId;
  }

  const email = await db.email.findUnique({ where: whereClause });

  if (!email) {
    throw new UnsendApiError({ code: "NOT_FOUND", message: "Email not found" });
  }

  return email;
};
