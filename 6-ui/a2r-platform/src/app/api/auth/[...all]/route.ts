import { auth } from "@/lib/auth-sqlite";
import { NextRequest } from "next/server";

export const GET = async (request: NextRequest) => {
  return auth.handler(request);
};

export const POST = async (request: NextRequest) => {
  return auth.handler(request);
};

export const PUT = async (request: NextRequest) => {
  return auth.handler(request);
};

export const DELETE = async (request: NextRequest) => {
  return auth.handler(request);
};
