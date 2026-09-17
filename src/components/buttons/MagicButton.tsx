import React from "react"
import { Button } from "@/components/ui/button"
import { WandSparkles } from "lucide-react"

const MagicButton = React.forwardRef(({ ...props }, ref) => {
  return (
    <Button
      ref={ref as any}
      {...props} // MUST SPREAD PROPS
      variant="outline"
      className="group relative overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/25 bg-transparent"
    >
      <WandSparkles className="w-4 h-4 mr-2 text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors duration-300 group-hover:rotate-12" />
      <span className="relative z-10 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
        Field Extractor
      </span>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-blue-400/10 to-blue-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
    </Button>
  )
})

MagicButton.displayName = "MagicButton"
export default MagicButton
