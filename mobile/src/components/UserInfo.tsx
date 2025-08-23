export const UserInfo = () => {
  return (
    <div className="bg-blue-500 items-center h-[100dvh] w-screen justify-center flex">
      <div className="flex flex-col justify-center gap-3 m-3">
        <div className="rounded-xl shadow-2xl bg-gray-100 p-3">
          <img
            className="w-full h-auto md:w-1/2 lg:w-1/3 object-cover"
            src="/images/avatar.svg"
            alt="avatar"
          />
        </div>

        <div className="rounded-xl shadow-2xl bg-gray-100 p-3 text-2xl text-center">
          <p>Name: Abu Sauban</p>
        </div>
        <div
          className="rounded-xl shadow-2xl bg-gray-100 p-5 text-xl text-center"
          text-center
        >
          <p>Email: sauban.ind@gmail.com</p>
        </div>
      </div>
    </div>
  );
};
