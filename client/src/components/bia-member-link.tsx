import React from "react";
import { Link } from "wouter";
import { getMembroUrl } from "../lib/public-refs";

/** Link only an explicit identity present in the same authorized directory as the profile. */
export function BiaMemberLink({ memberId, name, members, className = "" }: {
  memberId?: string | null;
  name: string;
  members: ReadonlyArray<{ id: string }>;
  className?: string;
}) {
  const member = memberId ? members.find(item => item.id === memberId) : undefined;
  if (!member || !name.trim()) return <span className={className}>{name}</span>;
  return <Link
    href={getMembroUrl(member)}
    aria-label={`Ver perfil de ${name}`}
    title={`Ver perfil de ${name}`}
    className={`${className} rounded-sm no-underline hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
  >{name}</Link>;
}
