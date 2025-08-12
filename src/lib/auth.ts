// Mock Auth - No Database Required!
export const auth = async () => {
  // Mock: always return demo user
  return {
    userId: 'user_demo_123',
    sessionId: 'session_demo_123'
  }
}

export const currentUser = async () => {
  // Mock: return demo user data
  return {
    id: 'user_demo_123',
    firstName: 'Demo',
    lastName: 'User',
    emailAddresses: [
      {
        emailAddress: 'demo@example.com'
      }
    ],
    imageUrl: 'https://via.placeholder.com/150'
  }
}