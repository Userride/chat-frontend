import { FormControl } from "@chakra-ui/form-control";
import { Input } from "@chakra-ui/input";
import { Box, Text } from "@chakra-ui/layout";
import "./styles.css";
import { IconButton, Spinner, useToast } from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowBackIcon, ViewIcon } from "@chakra-ui/icons";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import Lottie from "react-lottie";
import animationData from "../animations/typing.json";

import io from "socket.io-client";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";

const ENDPOINT = "https://chat-backend-3-xugy.onrender.com"; // Backend URL
var socket, selectedChatCompare;

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);
  const toast = useToast();

  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };

  const { selectedChat, setSelectedChat, user, notification, setNotification } =
    ChatState();

  // ✅ Fetch messages from the backend
  const fetchMessages = async () => {
    if (!selectedChat) return;

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      };

      setLoading(true);
      const { data } = await axios.get(
        `${ENDPOINT}/api/message/${selectedChat._id}`,
        config
      );

      setMessages(data);
      setLoading(false);

      console.log("✅ Joined chat:", selectedChat._id);
      socket.emit("join chat", selectedChat._id);
    } catch (error) {
      console.error("❌ Fetch Messages Error:", error);
      toast({
        title: "Error Occurred!",
        description: "Failed to Load Messages",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
    }
  };

  // ✅ Send message handler
  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      if (!selectedChat) {
        toast({
          title: "No Chat Selected",
          description: "Please select a chat to send a message.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      if (!socketConnected) {
        toast({
          title: "Socket Not Connected",
          description: "Please refresh the page or check the connection.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      socket.emit("stop typing", selectedChat._id);

      try {
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        };
        setNewMessage("");
        const { data } = await axios.post(
          `${ENDPOINT}/api/message`,
          {
            content: newMessage,
            chatId: selectedChat,
          },
          config
        );

        socket.emit("new message", data);
        setMessages([...messages, data]);
      } catch (error) {
        toast({
          title: "Error Occurred!",
          description: error.response?.data || "Failed to send message.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    }
  };

  // ✅ Setup Socket.IO connection
  useEffect(() => {
    socket = io(ENDPOINT, { transports: ["websocket"] });

    socket.emit("setup", user);
    socket.on("connected", () => {
      setSocketConnected(true);
      console.log("✅ Socket connected!");
    });

    socket.on("typing", () => setIsTyping(true));
    socket.on("stop typing", () => setIsTyping(false));

    return () => {
      console.log("⚠️ Disconnecting socket...");
      socket.disconnect();
    };
  }, [user]);

  // ✅ Listen for new messages
  useEffect(() => {
    fetchMessages();
    selectedChatCompare = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    socket.on("message received", (newMessageReceived) => {
      if (!selectedChatCompare || selectedChatCompare._id !== newMessageReceived.chat._id) {
        // Check if the new message is not already in the notification list
        if (!notification.some(msg => msg._id === newMessageReceived._id)) {
          setNotification([newMessageReceived, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages([...messages, newMessageReceived]);
      }
    });

    return () => {
      socket.off("message received");
    };
  }, [messages, notification, fetchAgain, selectedChatCompare]);

  // ✅ Handle typing indicator
  const typingHandler = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }
    
    let lastTypingTime = new Date().getTime();
    let timerLength = 3000;
    setTimeout(() => {
      let timeNow = new Date().getTime();
      let timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  return (
    <>
      {selectedChat ? (
        <>
          <Text
            fontSize={{ base: "28px", md: "30px" }}
            pb={3}
            px={2}
            w="100%"
            fontFamily="Work sans"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            position="relative"
          >
            <IconButton
              d={{ base: "flex", md: "none" }}
              icon={<ArrowBackIcon />}
              onClick={() => setSelectedChat("")}
            />
            {!selectedChat.isGroupChat ? (
              <>
                {getSender(user, selectedChat.users)}
                <Box position="absolute" top="5px" right="10px">
                  <ProfileModal user={getSenderFull(user, selectedChat.users)}>
                    <IconButton icon={<ViewIcon />} />
                  </ProfileModal>
                </Box>
              </>
            ) : (
              <>
                {selectedChat.chatName.toUpperCase()}
                <UpdateGroupChatModal fetchMessages={fetchMessages} fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
              </>
            )}
          </Text>
          <Box
            d="flex"
            flexDir="column"
            justifyContent="flex-end"
            p={3}
            bg="#E8E8E8"
            w="100%"
            h="100%"
            borderRadius="lg"
            overflowY="hidden"
          >
            {loading ? (
              <Spinner size="xl" w={20} h={20} alignSelf="center" margin="auto" />
            ) : (
              <ScrollableChat messages={messages} />
            )}
            <FormControl onKeyDown={sendMessage} id="first-name" isRequired mt={3}>
              {istyping && (
                <Lottie options={defaultOptions} width={70} style={{ marginBottom: 15, marginLeft: 0 }} />
              )}
              <Input
                variant="filled"
                bg="#E0E0E0"
                placeholder="Enter a message.."
                value={newMessage}
                onChange={typingHandler}
              />
            </FormControl>
          </Box>
        </>
      ) : (
        <Box d="flex" alignItems="center" justifyContent="center" h="100%">
          <Text fontSize="3xl" pb={3} fontFamily="Work sans">
            Click on a user to start chatting
          </Text>
        </Box>
      )}
    </>
  );
};

export default SingleChat;
