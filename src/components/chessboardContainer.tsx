import { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Move as ChessMove, Square } from 'chess.js'
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { makeMove, reset } from '../redux/slices/board';
import { safeGameMutate, safeGameMutateReturnMove } from '../@helpers';
import { AppState, LearnFailState, Move, MoveData, Orientation } from '../@constants';
import { determineMoveForHandleLearn, getMoveIfChildOfPrev } from '../handleLearnFuncs';

interface props {
   game: Chess,
   setGame: React.Dispatch<React.SetStateAction<Chess>>
}

const ChessboardContainer = (props: props) => {
   const dispatch = useAppDispatch();
   const boardOrientation = useAppSelector((state) => state.board.boardOrientation);
   const prevMove = useAppSelector((state) => state.board.prevMove)
   const appState = useAppSelector((state) => state.app.appState);
   const [boardWidth, setBoardWidth] = useState<number>(Math.min(window.innerHeight, window.innerWidth) * .95)

   const setBW = () => {
      setBoardWidth(Math.min(window.innerHeight, window.innerWidth) * .95)
   }

   useEffect(() => {
      window.addEventListener('resize', setBW)
      return () => {
         window.removeEventListener('resize', setBW)
      }
   }, [])

   const onDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
      let gameData: { newGame: Chess, moveMade: ChessMove } | undefined;
      try {
         gameData = safeGameMutateReturnMove(props.game, (game): ChessMove => {
            return game.move({
               from: sourceSquare,
               to: targetSquare,
               promotion: "q"
            })
         })
         props.setGame(gameData.newGame);
         // invalid moves return errors
      } catch { return false }
      if (!gameData) return false;

      const move = gameData.moveMade;
      if (appState == AppState.learn) {
         handleLearn(gameData.newGame, move);
         return true;
      }
      updateReduxWithMove(move.san, move.color.concat(move.piece), prevMove)
      return true;
   }

   const handleLearn = async (game: Chess, move: ChessMove) => {
      const autoMove: MoveData | LearnFailState = await determineMoveForHandleLearn(move, prevMove)

      if (autoMove == LearnFailState.end) { 
         setTimeout(() => {
            props.setGame(new Chess())
         }, 1000);
         dispatch(reset())
         return; 
      }
      if (autoMove == LearnFailState.incorrect) { 
         setTimeout(() => {
            props.setGame(safeGameMutate(game, (game) => {
               game.undo();
            }))
         }, 600);
         return; 
      }
      if (!autoMove) { console.log("undefined"); return; }

      setTimeout(() => {
         props.setGame(safeGameMutate(game, (game) => {
            game.move(autoMove.move);
         }))
      }, 200)

      const fetchedFirstMove = await updateReduxWithMove(move.san, move.color.concat(move.piece), prevMove)
      if (!fetchedFirstMove) return;
      await updateReduxWithMove(autoMove.move, autoMove.piece, fetchedFirstMove);
   }

   const updateReduxWithMove = async (move: string, piece: string, prevMove: Move): Promise<Move | undefined> => {
      const childMove: Move | undefined = await getMoveIfChildOfPrev(move, prevMove);
      if (childMove) {
         dispatch(makeMove(childMove))
         return childMove;
      } else {
         dispatch(makeMove({
            id: "",
            move: move,
            piece: piece,
            childData: []
         }));
      }
   }

   return (
      <div className='mx-6'>
         <Chessboard
            boardWidth={boardWidth}
            boardOrientation={boardOrientation}
            position={props.game.fen()}
            onPieceDrop={onDrop}
            customDarkSquareStyle={{ backgroundColor: '#769656' }}
            customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
            customBoardStyle={{ borderRadius: '5px' }}
         />
      </div>
   )
}

export default ChessboardContainer;