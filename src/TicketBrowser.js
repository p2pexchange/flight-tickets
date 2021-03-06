import React from 'react';
import SearchTicketForm from "./SearchTicketForm";
import BookFlightDialog from './BookFlightDialog';
import FlightSummary from './FlightSummary';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';


function SuccessDialog(props) {
  const { isOpen, onClose } = props;
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Booking completed!
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          You have purchased your tickets.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Continue Searching
        </Button>
        <Button onClick={() => onClose(true)} color="primary" variant="contained" autoFocus>
          Go To My Purchases
        </Button>
      </DialogActions>
    </Dialog>
  );
}


/** Display results of a search */
function SearchTicketResults(props) {
  const { resultsReady, flights, formatETH, sorting, onChangeSorting, onClickBook } = props;

  if (resultsReady) {
    if (flights.length === 0) {
      return (
        <div>
          <h2>Results</h2>
          <div>Sorry, no flights found. Try searching non-direct flights!</div>
        </div>
      );
    } else {
      switch (sorting) {
        case 'shortest':
          flights.sort((a, b) => {
            let durA = a.tickets[a.tickets.length - 1].tArrival - a.tickets[0].tDeparture;
            let durB = b.tickets[b.tickets.length - 1].tArrival - b.tickets[0].tDeparture;
            return durA > durB;
          });
          break;
        case 'cheapest':
        default:
          flights.sort((a, b) => (a.priceTotal > b.priceTotal));
      }
      return (
        <div>
          <h2>Results</h2>
          <RadioGroup
            value={sorting}
            onChange={onChangeSorting}
          >
            <FormControlLabel value="cheapest" control={<Radio color="primary" />} label="Cheapest first" />
            <FormControlLabel value="shortest" control={<Radio color="primary" />} label="Shortest first" />
          </RadioGroup>
          <div>
            {flights.map((flight, i) => (
              <Paper key={`sr-${i}`} className="search-result-paper">
                <FlightSummary
                  flight={flight}
                  formatETH={formatETH}
                  onClickBook={() => { onClickBook(flight); }}
                />
              </Paper>
            ))}
          </div>
        </div>
      );
    }
  } else {
    return '';
  }
}


/**
 * Ticket browser allows a customer to search & buy tickets.
 * @param web3 - instance of web3
 * @param contract - instance of the smart contract
 * @param account - address of the user
 * @param navigateToMyPurchases - function to nagivate the user to My Purchases
 * @param getTicketData - function to get detailed ticket data from ticket ID
 * @param onBookingComplete - function to be called when booking transaction is executed
 */
class TicketBrowser extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      // Flights found, each flight may consist of one or two tickets
      // Direct flights consist of only one ticket
      // One-stop flights consist of two tickets
      flights: [],
      resultsReady: false,
      sorting: 'cheapest',
      isBookDialogOpen: false,
      flightChosen: null,
      isSuccessDialogOpen: false
    }
  }

  /**
   * Validate the input before search is submitted
   * @param {object} search - object containing ticket data: { sFrom, sTo }
   * @return {object} - object of errors, empty object means no errors
   */
  searchValidate = (search) => {
    let errors = {};
    if (search.sFrom.length === 0) {
      errors.sFromError = 'Where are you travelling from?';
    }
    if (search.sTo.length === 0) {
      errors.sToError = 'Where are you travelling to?';
    }
    if (isNaN(search.sWhen)) {
      errors.sWhenError = 'Choose a date';
    }
    return errors;
  }

  /**
   * Search the tickets via the contract and display the result
   * @param search the search form data
   * @param onProcessed callback for when the processing is done and results are displayed
   */
  searchSubmit = (search, onProcessed) => {
    // Clear existing results first
    this.setState({
      flights: [],
      resultsReady: false
    }, () => {
      // Find only direct flights
      if (search.sOnlyDirect) {
        this.props.contract.findDirectFlights.call(
          this.props.web3.toHex(search.sFrom),
          this.props.web3.toHex(search.sTo),
          search.sWhen
        ).then(results => {
          for (let i = 0; i < results.length; i++) {
            let tId = Number(results[i]);
            if (tId === 0) {
              // end of results
              break;
            }
            this.props.getTicketData(tId).then(ticket => {
              // display the result
              this.setState(state => ({
                flights: [...state.flights, {
                  stops: 0,
                  priceTotal: ticket.tPrice,
                  tickets: [ticket]
                }]
              }));
            });
          }
          onProcessed();
          return this.setState({
            resultsReady: true
          });
        });
        // Find direct and one-stop flights
      } else {
        this.props.contract.findOneStopFlights.call(
          this.props.web3.toHex(search.sFrom),
          this.props.web3.toHex(search.sTo),
          search.sWhen
        ).then(results => {
          for (let i = 0; i < results.length; i++) {
            let tId1 = Number(results[i][0]);
            let tId2 = Number(results[i][1]);
            if (tId1 === 0) {
              // end of results
              break;
            }
            this.props.getTicketData(tId1).then(ticket1 => {
              if (tId2 === 0) {
                // this is a direct flight, display it on the page
                this.setState(state => ({
                  flights: [...state.flights, {
                    stops: 0,
                    priceTotal: ticket1.tPrice,
                    tickets: [ticket1]
                  }]
                }));
              } else {
                // this is a one-stop flight, get the second ticket...
                this.props.getTicketData(tId2).then(ticket2 => {
                  // ...and display it on the page
                  this.setState(state => ({
                    flights: [...state.flights, {
                      stops: 1,
                      priceTotal: ticket1.tPrice + ticket2.tPrice,
                      tickets: [ticket1, ticket2]
                    }]
                  }));
                });
              }
            });
          }
          onProcessed();
          return this.setState({
            resultsReady: true
          });
        }).catch(error => {
          console.log(error);
        });
      }
    });
  }

  formatETH = price => {
    return this.props.web3.fromWei(price, 'ether') + ' ETH';
  }

  onChangeSorting = e => {
    this.setState({ sorting: e.target.value });
  }

  onClickBook = (flight) => {
    this.setState({
      flightChosen: flight,
      isBookDialogOpen: true
    });
  }

  closeBookDialog = () => {
    this.setState({
      isBookDialogOpen: false
    });
  }

  submitBooking = (data, onSuccess, onFailure) => {
    let tId1 = data.flight.tickets[0].tId;
    let tId2 = data.flight.tickets.length > 1 ? data.flight.tickets[1].tId : 0;
    this.props.contract.bookFlight(
      [tId1, tId2],
      data.firstName,
      data.lastName,
      { from: this.props.account, value: data.flight.priceTotal }
    ).then(result => {
      onSuccess();
      this.setState({
        isBookDialogOpen: false,
        isSuccessDialogOpen: true
      });
      // Process results of the transaction
      this.props.onBookingComplete(result);
    }).catch(onFailure);
  }

  closeSuccessDialog = (goToMyPurchases) => {
    this.setState({
      isSuccessDialogOpen: false
    });
    if (goToMyPurchases) {
      this.props.navigateToMyPurchases();
    }
  }

  render() {
    return (
      <div>
        <h1>Where do you want to go?</h1>

        <Grid container spacing={24}>
          <Grid item xs={12}>
            <SearchTicketForm
              onValidate={this.searchValidate}
              onSubmit={this.searchSubmit}
            />
          </Grid>
          <Grid item xs={12}>
            <SearchTicketResults
              resultsReady={this.state.resultsReady}
              flights={this.state.flights}
              formatETH={this.formatETH}
              sorting={this.state.sorting}
              onChangeSorting={this.onChangeSorting}
              onClickBook={this.onClickBook}
            />
          </Grid>
        </Grid>
        <BookFlightDialog
          isOpen={this.state.isBookDialogOpen}
          flight={this.state.flightChosen}
          onClose={this.closeBookDialog}
          onSubmit={this.submitBooking}
          formatETH={this.formatETH}
        />
        <SuccessDialog
          isOpen={this.state.isSuccessDialogOpen}
          onClose={this.closeSuccessDialog}
        />
      </div>
    );
  }
}

export default TicketBrowser;