import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/account/wallets-page'

export const Route = createFileRoute('/_authed/wallets')({ component: WalletsPage })
