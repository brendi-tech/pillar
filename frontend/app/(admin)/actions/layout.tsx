import { redirect } from "next/navigation";

const Layout = ({ children }: { children: React.ReactNode }) => {
  redirect("/tools");
};

export default Layout;
