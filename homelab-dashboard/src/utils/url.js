const hostURL = "rpi5-server.home.arpa";
const baseUrl = "admin.rpi5-server.home.arpa";

const protocol = () => {
    return "https";
    const proto = window.location.protocol === "https:" ? "https" : "http";
    console.log("Using protocol:", proto);
    return proto;
};

export const getSubdomainUrl = (subdomain) => {
    return `${protocol()}://${subdomain}.${hostURL}`;
}

export const getApiUrl = (path) => {
    return `${protocol()}://${baseUrl}/api${path}`;
}