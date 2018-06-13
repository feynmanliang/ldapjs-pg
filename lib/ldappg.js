const ldap = require('ldapjs');

const { Client } = require('pg');
const baseDN = 'dc=gigster, dc=com';


const getUsers = async () => {
    const client = new Client({
        connectionString: process.env.PG_URI,
    });
    await client.connect();

    const res = await client.query(`SELECT email,password,id,name from users limit 10`);
    const users = res.rows.reduce((acc, user) => {
        const userDN = `cn=${user.email}, ${baseDN}`
        acc[userDN] = {
            dn: userDN,
            attributes: {
                uid: user.id,
                cn: user.email,
                sn: user.name,
                mail: user.email,
                objectclass: [
                    "inetorgperson",
                    "top",
                ],
                userPassword: user.password,
                givenName: user.name,
            },
        };
        return acc;
    }, {});
    await client.end();
    return users;
}

const server = ldap.createServer();
server.bind(baseDN, (req, res, next) => {
    // const username = req.dn.toString();
    // const password = req.credentials;

    res.end();
    return next();
});

server.search(baseDN, async (req, res, next) => {
    const bindDN = req.connection.ldap.bindDN.toString();
    const users = await getUsers();

    for (userDN in users) {
        const user = users[userDN];
        if (req.filter.matches(user.attributes)) {
            res.send(user);
        }
    }

    res.end();
});

server.listen(389, () => {
    console.log(`LDAP server listening at ${server.url}`);
});

module.exports = () => server;
