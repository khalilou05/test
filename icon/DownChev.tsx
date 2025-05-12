function DownChev({ ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      {...rest}
      className="p-1 rounded hover:bg-gray-600 cursor-pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="white"
        width={20}
        height={20}
      >
        <path
          fillRule="evenodd"
          d="M6.24 8.2a.75.75 0 0 1 1.06.04l2.7 2.908 2.7-2.908a.75.75 0 1 1 1.1 1.02l-3.25 3.5a.75.75 0 0 1-1.1 0l-3.25-3.5a.75.75 0 0 1 .04-1.06Z"
        />
      </svg>
    </button>
  );
}
export default DownChev;
