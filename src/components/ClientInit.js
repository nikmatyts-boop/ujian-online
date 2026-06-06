"use client";

import { useEffect } from "react";
import { initDb } from "@/lib/db";

export default function ClientInit() {
  useEffect(() => {
    initDb();
  }, []);

  return null;
}
