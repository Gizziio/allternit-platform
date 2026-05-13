import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function NewShellSessionPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/shell', { replace: true })
  }, [navigate])
  return null
}
