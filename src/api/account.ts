import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import {
  type AddWalletBody,
  type NewsletterBody,
  type PasswordBody,
  type ProfileBody,
  type Session,
  type Wallet,
  userSchema,
  walletListSchema,
} from './contracts'
import { sessionQuery } from './session'

export const walletsKey = (userId: string) => ['user', userId, 'wallets'] as const

function useSetUser() {
  const qc = useQueryClient()
  return (user: unknown) => {
    const parsed = userSchema.parse(user)
    qc.setQueryData<Session | null | undefined>(sessionQuery.queryKey, (old) => (old ? { ...old, user: parsed } : old))
  }
}

export function useUpdateProfile() {
  const setUser = useSetUser()
  return useMutation({
    mutationFn: async (body: ProfileBody) => (await api.patch('/profile', body)).data.user,
    onSuccess: setUser,
  })
}

export function useSetAvatar() {
  const setUser = useSetUser()
  return useMutation({
    mutationFn: async (dataUrl: string | null) =>
      (dataUrl ? await api.put('/profile/avatar', { dataUrl }) : await api.delete('/profile/avatar')).data.user,
    onSuccess: setUser,
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: async (body: PasswordBody) => void (await api.post('/profile/password', body)) })
}

// ---- Carteiras -------------------------------------------------------------

export function useWallets() {
  const { data: session } = useQuery(sessionQuery)
  const userId = session?.user.id ?? 'anon'
  return useQuery({
    queryKey: walletsKey(userId),
    enabled: Boolean(session),
    queryFn: async ({ signal }) => walletListSchema.parse((await api.get('/wallets', { signal })).data).items,
  })
}

/** Escritas de carteira são serializadas e sempre terminam reconciliando com o servidor. */
function useWalletMutation<V>(
  fn: (v: V) => Promise<unknown>,
  optimistic?: (list: Wallet[], v: V) => Wallet[],
) {
  const qc = useQueryClient()
  const { data: session } = useQuery(sessionQuery)
  const key = walletsKey(session?.user.id ?? 'anon')
  return useMutation({
    mutationKey: ['wallet-write'],
    scope: { id: 'wallets' },
    mutationFn: fn,
    onMutate: async (v) => {
      if (!optimistic) return { previous: undefined }
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Wallet[]>(key)
      if (previous) qc.setQueryData<Wallet[]>(key, optimistic(previous, v))
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ['wallet-write'] }) <= 1) void qc.invalidateQueries({ queryKey: key })
    },
  })
}

export const useAddWallet = () => useWalletMutation((body: AddWalletBody) => api.post('/wallets', body))

export const useSetPrimaryWallet = () =>
  useWalletMutation(
    (id: string) => api.put(`/wallets/${encodeURIComponent(id)}/primary`),
    (list, id) => list.map((w) => ({ ...w, isPrimary: w.id === id })),
  )

export const useRemoveWallet = () =>
  useWalletMutation(
    (id: string) => api.delete(`/wallets/${encodeURIComponent(id)}`),
    (list, id) => list.filter((w) => w.id !== id),
  )

export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: async (body: NewsletterBody) => (await api.post('/newsletter', body)).data as { subscribed: true },
  })
}
