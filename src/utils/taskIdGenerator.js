export const generateTaskID = (title) => {
    return `${title.replace(/-/g, '').slice(0, 4).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;
};

