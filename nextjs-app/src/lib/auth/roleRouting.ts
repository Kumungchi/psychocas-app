export type MemberRole = 'member' | 'manager' | 'council' | 'technician'

export const ROLE_DEFAULT_REDIRECT: Record<MemberRole, string> = {
  member: '/home',
  manager: '/stats',
  council: '/admin',
  technician: '/technician',
}

export const ROLE_ALLOWED_PATHS: Record<MemberRole, readonly string[]> = {
  member: ['/home', '/redeem'],
  manager: ['/home', '/redeem', '/validate', '/stats'],
  council: ['/home', '/redeem', '/validate', '/stats', '/admin', '/technician'],
  technician: ['/home', '/redeem', '/technician'],
}

export type MemberSummary = { role: MemberRole; email: string | null }

export const hasPsychocasEmail = (email: string | null | undefined) =>
  typeof email === 'string' && email.toLowerCase().endsWith('@psychocas.cz')

export const normaliseRole = (member: MemberSummary | null): MemberRole => {
  if (!member) {
    return 'member'
  }

  if (member.role === 'council') {
    return 'council'
  }

  if (member.role === 'technician') {
    return hasPsychocasEmail(member.email) ? 'technician' : 'member'
  }

  if (member.role === 'manager' && hasPsychocasEmail(member.email)) {
    return 'manager'
  }

  return 'member'
}

const getPathWithoutQueryOrHash = (path: string) => {
  const [cleanPath] = path.split('#', 1)
  return cleanPath.split('?')[0]
}

export const isAllowedRedirect = (path: string, role: MemberRole) => {
  const basePath = getPathWithoutQueryOrHash(path)
  return ROLE_ALLOWED_PATHS[role].some((allowed) =>
    basePath === allowed || basePath.startsWith(`${allowed}/`)
  )
}
