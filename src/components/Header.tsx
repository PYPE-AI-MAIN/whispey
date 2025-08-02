"use client"
import { UserButton, SignedIn } from "@clerk/clerk-react";
import Image from "next/image";

function Header() {
  return (
    <SignedIn>

<header className="px-6 py-8">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className='flex items-center gap-2'>
            <Image src="/pype_ai_logo.jpeg" alt="Pype AI Logo" width={80} height={80} />
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Pype Voice</h1>
              <p className="text-gray-500 mt-1">Voice AI Platform</p>
            </div>
          </div>
          <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-8 h-8"
            }
          }}
          userProfileProps={{
            appearance: {
              elements: {
                card: "shadow-xl"
              }
            }
          }}
        />
         
        </div>
      </header>
       
    </SignedIn>
  )
}

export default Header;