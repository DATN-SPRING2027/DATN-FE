"use client";

import { useEffect, useState } from "react";
import MemberNotification from "./members/MemberNotification";

export default function ProjectVisibilityNotification({
  message,
}: {
  message: string;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(timer);
  }, []);
  return visible ? <MemberNotification message={message} /> : null;
}
