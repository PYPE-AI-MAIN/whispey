"use client"

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface GitHubRepo {
  stargazers_count: number;
  forks_count: number;
}

export function useGitHubStars(owner: string, repo: string) {
  const [stars, setStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStars() {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        if (response.ok) {
          const data: GitHubRepo = await response.json();
          setStars(data.stargazers_count);
        }
      } catch (error) {
        console.error('Failed to fetch GitHub stars:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStars();
  }, [owner, repo]);

  return { stars, loading };
}

export function GitHubStarsButton() {
  const { stars, loading } = useGitHubStars('PYPE-AI-MAIN', 'whispey');

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <Link
      href="https://github.com/PYPE-AI-MAIN/whispey/stargazers"
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-300 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100/50 dark:hover:from-gray-800 dark:hover:to-gray-700/50 border border-gray-200/80 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm active:scale-[0.98] backdrop-blur-sm overflow-hidden"
    >
      {/* GitHub Icon */}
      <div className="relative">
        <svg 
          height="18" 
          width="18" 
          viewBox="0 0 24 24" 
          className="fill-gray-700 dark:fill-gray-300 group-hover:fill-gray-900 dark:group-hover:fill-gray-100 transition-all duration-300 group-hover:scale-110"
          aria-hidden="true"
        >
          <path d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.432 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.157-5.019 5.432.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z"></path>
        </svg>
      </div>
      
      {/* Star section with better spacing */}
      <div className="flex items-center gap-1.5">
        <svg 
          className="w-4 h-4 text-yellow-500 group-hover:text-yellow-600 dark:text-yellow-400 dark:group-hover:text-yellow-500 transition-colors duration-300" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>

        {loading ? (
          <div className="flex items-center">
            <div className="w-8 h-5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded-md bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"></div>
          </div>
        ) : (
          <div className="flex items-center">
            <span className="font-bold text-xs text-gray-900 dark:text-gray-100 tabular-nums bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text group-hover:from-black group-hover:to-gray-800 dark:group-hover:from-white dark:group-hover:to-gray-200 transition-all duration-300">
              {stars ? formatStars(stars) : '0'}
            </span>
          </div>
        )}
      </div>
      
      {/* External link indicator with better positioning */}
      <svg 
        className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 opacity-70 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        strokeWidth={2.5}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
        />
      </svg>

      {/* Contained hover shimmer effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_0.8s_ease-out] pointer-events-none"></div>
    </Link>
  );
}