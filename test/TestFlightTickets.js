const FlightTickets = artifacts.require("FlightTickets");

async function hasReverted(contractCall) {
  try {
    await contractCall;
    return false;
  } catch (e) {
    return /revert/.test(e.message);
  }
}

contract('FlightTickets', accounts => {
  let flightTickets;

  beforeEach(async () => {
    flightTickets = await FlightTickets.deployed();
  });

  it('sets the owner', async () => {
    assert.equal(await flightTickets.owner.call(), accounts[0]);
  });

  it('does not allow to add an airline from a non-owner', async () => {
    assert.ok(await hasReverted(
      flightTickets.addAirline('Test Airline', accounts[2], { from: accounts[1] })
    ));
  });

  it('adds an airline from the owner', async () => {
    await flightTickets.addAirline('Test Airline', accounts[2], { from: accounts[0] });
    assert.equal(await flightTickets.getAirlinesCount.call(), 1);
  });

  it('confirms that the airline exists', async () => {
    let exists = await flightTickets.airlineExists.call('Test Airline');
    assert.ok(exists);
  });

  it('does not allow to add an airline when the name is taken', async () => {
    assert.ok(await hasReverted(
      flightTickets.addAirline('Test Airline', accounts[2], { from: accounts[0] })
    ));
  });

  it('stores the airline data', async () => {
    let [aId, aName, aOwner] = await flightTickets.airlines.call(0);
    aName = web3.toUtf8(aName);
    assert.equal(aId, 1);
    assert.equal(aName, 'Test Airline');
    assert.equal(aOwner, accounts[2]);
  });

  it('edits an airline', async () => {
    await flightTickets.editAirline(1, 'New Airline Name', accounts[3]);
    let [aId, aName, aOwner] = await flightTickets.airlines.call(0);
    aName = web3.toUtf8(aName);
    assert.equal(aId, 1);
    assert.equal(aName, 'New Airline Name');
    assert.equal(aOwner, accounts[3]);
  });

  it('does not allow to edit an airline when the new name is taken', async () => {
    await flightTickets.addAirline('Second Airline', accounts[4], { from: accounts[0] });
    assert.ok(await hasReverted(
      flightTickets.editAirline(1, 'Second Airline', accounts[3])
    ));
  });

  it('removes an airline', async () => {
    let count = await flightTickets.getAirlinesCount.call();
    await flightTickets.removeAirline(1);
    let newCount = await flightTickets.getAirlinesCount.call();
    assert.equal(newCount, count - 1);
    let exists = await flightTickets.airlineExists('New Airline Name');
    assert.ok(!exists);
  });

  // existing airline by now: {aId: 2, aName: 'Second Airline', aOwner: accounts[4]}
  // we will use it for the ticket-related tests below

  const AID = 2;
  const AOWNER = accounts[4];
  const TPRICE = web3.toWei(100, 'finney');
  const TFROM = 'Hong Kong';
  const TTO = 'Denpasar';
  const TQUANTITY = 150;
  const TDEPARTURE = 1536573600;
  const TARRIVAL = 1536589800;

  it('does not allow to add a ticket from a non-owner of the airline', async () => {
    assert.ok(await hasReverted(
      flightTickets.addTicket(AID, TFROM, TTO, TPRICE, TQUANTITY, TDEPARTURE, TARRIVAL, { from: accounts[0] })
    ));
  });

  it('adds tickets from the owner of the airline', async () => {
    await flightTickets.addTicket(AID, TFROM, TTO, TPRICE, TQUANTITY, TDEPARTURE, TARRIVAL, { from: AOWNER });
    // add some more
    await flightTickets.addTicket(AID, 'Denpasar', 'Tokyo', web3.toWei(300, 'finney'), 50, 1536589800, 1536607800, { from: AOWNER });
    await flightTickets.addTicket(AID, 'Zhengzhou', 'Singapore', web3.toWei(50, 'finney'), 200, 1536589800, 1536607800, { from: AOWNER });
    assert.equal(await flightTickets.getTicketsCount.call(AID), 3);
  });

  const TID = 1;

  it('stores the ticket data', async () => {
    let [tId, aId, tFrom, tTo, tPrice, tQuantity, tDeparture, tArrival] = await flightTickets.tickets.call(0);
    tFrom = web3.toUtf8(tFrom);
    tTo = web3.toUtf8(tTo);
    assert.equal(tId, TID);
    assert.equal(aId, AID);
    assert.equal(tFrom, TFROM);
    assert.equal(tTo, TTO);
    assert.equal(tPrice, TPRICE);
    assert.equal(tQuantity, TQUANTITY);
    assert.equal(tDeparture, TDEPARTURE);
    assert.equal(tArrival, TARRIVAL);
  });

  it('edits a ticket', async () => {
    let newPrice = TPRICE * 2;
    let newQuantity = TQUANTITY - 50;
    await flightTickets.editTicket(TID, newPrice, newQuantity, { from: AOWNER });
    let [tId, aId, tFrom, tTo, tPrice, tQuantity, tDeparture, tArrival] = await flightTickets.tickets.call(0);
    assert.equal(tPrice, newPrice);
    assert.equal(tQuantity, newQuantity);
  });

  it('removes a ticket', async () => {
    let count = await flightTickets.getTicketsCount.call(AID);
    await flightTickets.removeTicket(TID, { from: AOWNER });
    let newCount = await flightTickets.getTicketsCount.call(AID);
    assert.equal(newCount, count - 1);
  });

  it('finds a direct flight', async () => {
    await flightTickets.addTicket(AID, 'Bangkok', 'Dubai', web3.toWei(150, 'finney'), 50, 1536589800, 1536607800, { from: AOWNER });
    await flightTickets.addTicket(AID, 'Dubai', 'London', web3.toWei(100, 'finney'), 50, 1536589800, 1536607800, { from: AOWNER });
    await flightTickets.addTicket(AID, 'London', 'New York', web3.toWei(200, 'finney'), 50, 1536589800, 1536607800, { from: AOWNER });
    tickets = await flightTickets.findTickets.call('Dubai', 'London');
    let _tId = Number(tickets[0]);
    assert.ok(_tId > 0);
    let [tId, aId, tFrom, tTo, tPrice, tQuantity, tDeparture, tArrival] = await flightTickets.getTicketById.call(_tId);
    tFrom = web3.toUtf8(tFrom);
    tTo = web3.toUtf8(tTo);
    assert.equal(tFrom, 'Dubai');
    assert.equal(tTo, 'London');
  });

});