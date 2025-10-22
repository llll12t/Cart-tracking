// Skeleton UI สำหรับ BookingForm

export default function BookingFormSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 animate-pulse">
      {/* Vehicle Selection Skeleton */}
      <div className="mb-6">
        <div className="h-5 bg-gray-300 rounded w-32 mb-3"></div>
        <div className="h-12 bg-gray-300 rounded-lg"></div>
      </div>

      {/* Date/Time Skeleton */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="h-5 bg-gray-300 rounded w-24 mb-3"></div>
          <div className="h-12 bg-gray-300 rounded-lg"></div>
        </div>
        <div>
          <div className="h-5 bg-gray-300 rounded w-24 mb-3"></div>
          <div className="h-12 bg-gray-300 rounded-lg"></div>
        </div>
      </div>

      {/* Origin/Destination Skeleton */}
      <div className="mb-6">
        <div className="h-5 bg-gray-300 rounded w-20 mb-3"></div>
        <div className="h-12 bg-gray-300 rounded-lg mb-4"></div>
        <div className="h-5 bg-gray-300 rounded w-24 mb-3"></div>
        <div className="h-12 bg-gray-300 rounded-lg"></div>
      </div>

      {/* Purpose Skeleton */}
      <div className="mb-6">
        <div className="h-5 bg-gray-300 rounded w-32 mb-3"></div>
        <div className="h-24 bg-gray-300 rounded-lg"></div>
      </div>

      {/* Submit Button Skeleton */}
      <div className="h-12 bg-gray-300 rounded-lg"></div>
    </div>
  );
}
