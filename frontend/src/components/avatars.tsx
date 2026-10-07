import { cn } from "cn"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Repository } from "@/lib/api/types"

function initials(fullName: string): string {
  const name = fullName.split("/").at(-1) ?? fullName
  return name
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2)
    .toUpperCase()
}

export function RepoAvatar({
  repository,
  className,
}: {
  repository: Pick<Repository, "full_name" | "owner_avatar_url">
  className?: string
}) {
  return (
    <Avatar className={cn("rounded-lg after:rounded-lg", className)}>
      <AvatarImage
        src={`${repository.owner_avatar_url}${repository.owner_avatar_url.includes("?") ? "&" : "?"}s=96`}
        alt=""
        className="rounded-lg"
      />
      <AvatarFallback className="rounded-lg text-xs">
        {initials(repository.full_name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function UserAvatar({
  login,
  avatarUrl,
  className,
}: {
  login: string
  avatarUrl: string | null
  className?: string
}) {
  return (
    <Avatar className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className="text-[10px]">{login.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
